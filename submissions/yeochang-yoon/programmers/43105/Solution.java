import java.util.*;

class Solution {

    private int[][] triangle;
    private int[][] memo;

    public int solution(int[][] triangle) {

        this.triangle = triangle;
        memo = new int[triangle.length][];

        for(int i = 0; i < triangle.length; i++){
            memo[i] = new int[triangle[i].length];
            Arrays.fill(memo[i], -1);
        }

        int answer = func(0, 0);
        return answer;
    }
    //다음놈이 map에 존재해? 그럼 그냥 리턴
    //다음놈이 map에 존재 안해? 그럼 내려가 func로 해서.
    //그리고 현재 나는 무조건 map에 저장하고 그거 반환하는거지 뭐.
    public int func(int depth, int index){
        if(depth == triangle.length-1){
            memo[depth][index] = triangle[depth][index];
            return memo[depth][index];
        }


        int n1 = 0;
        int n2 = 0;
        //다음타자 1번 func(depth+1, index)
        if(memo[depth+1][index] != -1){
            n1 = memo[depth+1][index];
        } else{
            n1 = func(depth+1, index);
        }

        //다음타자 2번 func(depth+1, index+1)
        if(memo[depth+1][index+1] != -1){
            n2 = memo[depth+1][index+1];
        } else{
            n2 = func(depth+1, index+1);
        }

        int sum = triangle[depth][index] + Math.max(n1, n2);

        memo[depth][index] = sum;

        return memo[depth][index];
    }
}