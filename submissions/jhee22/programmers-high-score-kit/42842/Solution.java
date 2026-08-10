/*
    (1) brown + yellow 합의 약수쌍 (X,Y) 탐색, 이제 x >= y인 
    (2) yellow = (x-2, y-2) 인 x, y 탐색 
    (3) 끗. 
*/ 
import java.util.*; 
class Solution {
    public int[] solution(int brown, int yellow) {
        // 디버깅용 
        ArrayList<Integer> answer = new ArrayList<>(); 
        
        int carpet = brown + yellow; 
        ArrayList<Integer> divisorX = new ArrayList<>(); 
        ArrayList<Integer> divisorY = new ArrayList<>(); 
        
        // 약수쌍 찾기 
        for (int i = 1; i <= (int)Math.sqrt(carpet); i++) {
            if (carpet % i == 0) {
                divisorX.add(carpet/i);
                divisorY.add(i); 
            }        
        }
        // System.out.println(divisor); 
        
        // (x-2)(y-2) 을 만족하는 약수쌍 찾기
        for (int i = 0; i < divisorX.size(); i++) {
            if ((divisorX.get(i) -2) * (divisorY.get(i) - 2) == yellow){
                answer.add(divisorX.get(i));
                answer.add(divisorY.get(i));
            }
        }
        
        int[] result = new int[answer.size()]; 
        for (int i = 0; i < answer.size(); i++) {
            result[i] = answer.get(i); 
        }
        return result; 
    }
}