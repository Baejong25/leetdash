import java.util.*;

class Solution {

    private String[] words;
    private boolean[] visit;
    private int result;

    public int solution(String begin, String target, String[] words) {

        this.words = words;
        visit = new boolean[words.length];

        boolean isExist = false;
        for(int i = 0; i < words.length; i++){
            if(words[i].equals(target)){
                isExist = true;
            }
        }

        if(!isExist){
            return 0;
        }

        change(begin, target, 0);

        return result;

    }//solution

    public void change(String current, String target, int count){

        if(current.equals(target)){
            result = count;
            return;
        }

        if(count > words.length){
            result = 0;
            return;
        }

        for(int i = 0; i < words.length; i++){
            if(visit[i]){
                continue;
            }

            int diff = 0;
            for(int j = 0; j < current.length(); j++){
                if(current.charAt(j) != words[i].charAt(j)){
                    diff++;
                }
            }
            if(diff > 1){
                continue;
            }

            visit[i] = true;

            change(words[i], target, count+1);

            visit[i] = false;
        }
    }//change
}