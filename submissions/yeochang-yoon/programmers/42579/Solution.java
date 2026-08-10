import java.util.*;
import java.util.stream.*;

class Solution {
    public int[] solution(String[] genres, int[] plays) {

        // 장르와 총 조회수를 저장
        Map<String, Integer> total = new HashMap<>();
        // 장르와 조회수1위 인덱스 저장
        Map<String, Integer> first = new HashMap<>();
        // 장르와 조회수2위 인덱스 저장
        Map<String, Integer> second = new HashMap<>();

        for(int i = 0; i < genres.length; i++){
            //총 조회수 꺼내서 있으면 현재 조회수 추가해서 저장하고 없으면 현재 조회수 저장.
            Integer n1 = total.get(genres[i]);
            if(n1 == null){
                total.put(genres[i], plays[i]);
                first.put(genres[i], i);
                continue;
            }else{
                total.put(genres[i], n1 + plays[i]);
            }

            //총 조회수 저장할때 무조건 first는 저장되기때문에 존재 유무 판단할 필요 없음
            //큰 경우에는 교체하지만 같은경우엔 인덱스가 더 커서 어차피 second로 가고 작아도 second로 가서 끝.
            Integer n2 = first.get(genres[i]);
            if(plays[n2] < plays[i]){
                first.put(genres[i], i);
                second.put(genres[i], n2);
                continue;
            }

            //존재하면 비교해서 넣고 존재 안하면 그냥 넣음.
            Integer n3 = second.get(genres[i]);
            if(n3 == null){
                second.put(genres[i], i);
                continue;
            }else{
                if(plays[n3] < plays[i]){
                    second.put(genres[i], i);
                }
            }
        }

        List<String> sortedKeys = total.keySet().stream()
                .sorted(Collections.reverseOrder(Comparator.comparingInt(total::get))) // value 기준으로 정렬
                .collect(Collectors.toList());

        List<Integer> result = new ArrayList<>();

        for(int i = 0; i < sortedKeys.size(); i++){
            Integer one = first.get(sortedKeys.get(i));
            Integer two = second.get(sortedKeys.get(i));

            result.add(one);
            if(two != null){
                result.add(two);
            }
        }

        int[] answer = result.stream()
                .mapToInt(Integer::intValue)
                .toArray();
        return answer;
    }
}